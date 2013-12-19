require 'spec_helper'
require_relative '../strsim'

describe 'get_trigrams' do
	context 'when str is nil' do
		before do
			@result = Strsim.get_trigrams(nil)
		end
		it 'should return an empty array' do
			@result.should eql([])
		end
	end
	context 'when str is empty' do
		before do
			@result = Strsim.get_trigrams('')
		end
		it 'should return an empty array' do
			@result.should eql([])
		end
	end
	context 'when str is "ab cd"' do
		before do
			@result = Strsim.get_trigrams('ab c')
		end
		it 'should return ["__a", "_ab", "ab ", "b c", " c_", "c__"]' do
			@result.should eql(["__a", "_ab", "ab ", "b c", " c_", "c__"])
		end
	end

end

describe "strsim", "Simple error-handling in overlap method" do
end

describe "strsim", "Simple error-handling in Jaccard similarity coefficient calculation method" do
  it 'should handle null input'
  it 'should handle empty input'
end

describe "strsim", "Basic functionality test of overlap method" do
  it 'should do the right thing with 100% overlap'
  it 'should do the right thing with 0% overlap'
  it 'should do the right thing with 50% overlap'
end

describe "strsim", "Basic functionality test of Jaccard similarity coefficient calculation method" do
  it 'should do the right thing with 100% similarity' do 
    string1 = "AAAAAA"
    string2 = "AAAAAA"
    Strsim.jaccard(string1, string2).should eql (1.0)
  end  
  it 'should do the right thing with 0% similarity' do
    string1 = "A"
    string2 = "B"
    Strsim.jaccard(string1, string2).should eql (0.0)
  end 
  it 'should do the right thing with similarity between 0 and 1.0' do
    string1 = "ABCD"
    string2 = "ABXY"
    Strsim.jaccard(string1, string2).should be_within(0.01).of(0.333)
  end
end
