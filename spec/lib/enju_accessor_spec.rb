require 'spec_helper'

describe "EnjuAccessor" do
  context "for passing of empty string" do
    before do
      @enju = EnjuAccessor.new "http://bionlp.dbcls.jp/enju/cgi-lilfes/enju"
    end

    it "should return empty array" do
      @enju.parse(nil).should eql []
      @enju.parse("").should eql []
      @enju.parse("  ").should eql []
    end
  end

  context "with a valid enju accessor" do
    before do
      @enju = EnjuAccessor.new "http://bionlp.dbcls.jp/enju/cgi-lilfes/enju"
    end

    context "with a normal imperative sentence" do
      before do
        @p = @enju.parse("Show me devices used to treat heart failure.")
                        # 01234567890123456789012345678901234567890123
      end

      it "should return the right length of tparses array" do
        @p[:tokens].length.should eql 8
      end

      it "should find the right root" do
        @p[:root].should eql 0
      end

      it "should find the right focus" do
        @p[:focus].should eql 2
      end

      it "should find the right noun chunks" do
        @p[:base_noun_chunks].should eql([{:head=>2, :beg=>2, :end=>2}, {:head=>7, :beg=>6, :end=>7}])
      end

      it "should find right relations" do
        @p[:relations].should include([2, [3, 5], 7])
      end
    end

    context "with a normal interogative sentence" do
      before do
        @p = @enju.parse("what genes are associated with kabuki syndrome?")
                        # 01234567890123456789012345678901234567890123456789
      end

      it "should return the right length of tparses array" do
        @p[:tokens].length.should eql 7
      end

      it "should find the right root" do
        @p[:root].should eql 3
      end

      it "should find the right focus" do
        @p[:focus].should eql 1
      end

      it "should find the right noun chunk heads" do
        @p[:base_noun_chunks].should eql([{:head=>1, :beg=>1, :end=>1}, {:head=>6, :beg=>5, :end=>6}])
      end

      it "should find right relations" do
        @p[:relations].should include([1, [3, 4], 6])
      end
    end

  end
end
